// Package videoframes extracts still frames and cover images from video and
// animated-image files using ffmpeg.
//
// Why frames at all: moderating video directly would need a specialised (and
// expensive) video-analysis service. A video is a sequence of pictures, so
// sampling a handful of frames and running them through the vision moderation
// we already have costs a fraction of that and catches the same violations.
//
// Why on the server and never on the client: frames are a security control. A
// patched client could sample a safe video, upload an unsafe one and have the
// verdict apply to the wrong bytes. Compression and cover generation may happen
// on the device (that is UX and bandwidth), but the frames the moderator sees
// have to be produced where the user cannot substitute them.
package videoframes

import (
	"context"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"time"
)

// Errors returned to callers. Everything else is wrapped with context.
var (
	// ErrProbeFailed means ffprobe could not read the file: it is not a video,
	// or it is corrupt. Treated as a rejection, not an infrastructure failure —
	// a file we cannot inspect must not be published unchecked.
	ErrProbeFailed = errors.New("cannot probe media file")
	// ErrNoFrames means ffmpeg produced no output frames despite a successful
	// probe.
	ErrNoFrames = errors.New("no frames extracted")
	// ErrToolMissing means ffmpeg/ffprobe is not installed. This is an
	// infrastructure problem: the job should retry rather than reject the file.
	ErrToolMissing = errors.New("ffmpeg tooling unavailable")
)

// Extractor runs ffmpeg/ffprobe as subprocesses.
//
// Paths are configurable so the worker image can pin exact binaries, and so a
// test can point at a stub.
type Extractor struct {
	ffmpegPath  string
	ffprobePath string
	// timeout bounds a single ffmpeg/ffprobe invocation. A malformed file can
	// otherwise keep the process spinning, and on a two-core server that
	// starves the API.
	timeout time.Duration
}

// Config for NewExtractor. Zero values fall back to sane defaults.
type Config struct {
	FFmpegPath  string
	FFprobePath string
	Timeout     time.Duration
}

func New(cfg Config) *Extractor {
	e := &Extractor{
		ffmpegPath:  cfg.FFmpegPath,
		ffprobePath: cfg.FFprobePath,
		timeout:     cfg.Timeout,
	}
	if e.ffmpegPath == "" {
		e.ffmpegPath = "ffmpeg"
	}
	if e.ffprobePath == "" {
		e.ffprobePath = "ffprobe"
	}
	if e.timeout <= 0 {
		e.timeout = 60 * time.Second
	}
	return e
}

// Available reports whether both binaries can be found. Used at startup so the
// service can log a clear warning instead of failing on the first video.
func (e *Extractor) Available() bool {
	for _, bin := range []string{e.ffmpegPath, e.ffprobePath} {
		if _, err := exec.LookPath(bin); err != nil {
			return false
		}
	}
	return true
}

// MediaInfo is what ffprobe tells us about a file.
type MediaInfo struct {
	// DurationSeconds is rounded up: a 30.4s clip counts as 31s against the
	// limit, so a limit of 60 cannot be exceeded by rounding down.
	DurationSeconds int
	Width           int
	Height          int
	HasVideoStream  bool
}

// Probe reads duration and dimensions.
//
// The declared MIME type is not trusted: a client can label anything as
// video/mp4, and the whole point of probing is to learn what the bytes actually
// are before spending money on moderation.
func (e *Extractor) Probe(ctx context.Context, path string) (MediaInfo, error) {
	if _, err := exec.LookPath(e.ffprobePath); err != nil {
		return MediaInfo{}, ErrToolMissing
	}

	cmdCtx, cancel := context.WithTimeout(ctx, e.timeout)
	defer cancel()

	// One line per field keeps parsing trivial and avoids pulling in a JSON
	// schema for three numbers.
	cmd := exec.CommandContext(cmdCtx, e.ffprobePath,
		"-v", "error",
		"-select_streams", "v:0",
		"-show_entries", "stream=width,height",
		"-show_entries", "format=duration",
		"-of", "default=noprint_wrappers=1",
		path,
	)
	out, err := cmd.Output()
	if err != nil {
		return MediaInfo{}, fmt.Errorf("%w: %v", ErrProbeFailed, err)
	}

	info := MediaInfo{}
	for _, line := range strings.Split(string(out), "\n") {
		key, value, found := strings.Cut(strings.TrimSpace(line), "=")
		if !found || value == "" || value == "N/A" {
			continue
		}
		switch key {
		case "width":
			if n, err := strconv.Atoi(value); err == nil && n > 0 {
				info.Width = n
				info.HasVideoStream = true
			}
		case "height":
			if n, err := strconv.Atoi(value); err == nil && n > 0 {
				info.Height = n
			}
		case "duration":
			if f, err := strconv.ParseFloat(value, 64); err == nil && f > 0 {
				// Round up, see MediaInfo.DurationSeconds.
				info.DurationSeconds = int(f)
				if f > float64(info.DurationSeconds) {
					info.DurationSeconds++
				}
			}
		}
	}

	if !info.HasVideoStream {
		return MediaInfo{}, fmt.Errorf("%w: no video stream", ErrProbeFailed)
	}
	return info, nil
}

// ExtractFramesOptions controls frame sampling.
type ExtractOptions struct {
	// IntervalSeconds between sampled frames. 3-5s is the useful range: a
	// 30-second clip yields 6-10 frames, which is cheap enough to moderate and
	// dense enough that a violation has to be very brief to slip through.
	IntervalSeconds int
	// MaxFrames caps the sample regardless of duration, so a long file cannot
	// turn into an unbounded number of paid vision calls.
	MaxFrames int
	// Width to downscale frames to. The moderation model does not need full
	// resolution, and smaller frames mean smaller data URLs.
	Width int
}

// DefaultExtractOptions matches the agreed policy: a frame every 4 seconds, at
// most 10 frames, downscaled to 640px wide.
func DefaultExtractOptions() ExtractOptions {
	return ExtractOptions{IntervalSeconds: 4, MaxFrames: 10, Width: 640}
}

// ExtractFrames samples JPEG frames into destDir and returns their paths in
// chronological order.
//
// Uses a single ffmpeg pass with an fps filter rather than one seek per frame:
// on a short clip the whole file is read once either way, and one subprocess is
// far cheaper than ten on a two-core box. The `-an` flag drops audio decoding,
// which is pure waste here.
func (e *Extractor) ExtractFrames(ctx context.Context, path, destDir string, opts ExtractOptions) ([]string, error) {
	if _, err := exec.LookPath(e.ffmpegPath); err != nil {
		return nil, ErrToolMissing
	}
	if opts.IntervalSeconds <= 0 {
		opts.IntervalSeconds = 4
	}
	if opts.MaxFrames <= 0 {
		opts.MaxFrames = 10
	}
	if opts.Width <= 0 {
		opts.Width = 640
	}

	cmdCtx, cancel := context.WithTimeout(ctx, e.timeout)
	defer cancel()

	pattern := filepath.Join(destDir, "frame_%03d.jpg")
	cmd := exec.CommandContext(cmdCtx, e.ffmpegPath,
		"-v", "error",
		"-i", path,
		"-an",
		// fps=1/N gives one frame every N seconds; scale keeps aspect ratio
		// (-1 would allow odd heights, -2 keeps them even for the encoder).
		"-vf", fmt.Sprintf("fps=1/%d,scale=%d:-2", opts.IntervalSeconds, opts.Width),
		"-frames:v", strconv.Itoa(opts.MaxFrames),
		"-q:v", "4",
		"-y",
		pattern,
	)
	if out, err := cmd.CombinedOutput(); err != nil {
		return nil, fmt.Errorf("ffmpeg frames: %v: %s", err, strings.TrimSpace(string(out)))
	}

	frames, err := filepath.Glob(filepath.Join(destDir, "frame_*.jpg"))
	if err != nil {
		return nil, err
	}
	if len(frames) == 0 {
		return nil, ErrNoFrames
	}
	// Glob sorts lexicographically and the pattern is zero-padded, so this is
	// already chronological.
	return frames, nil
}

// ExtractCover writes a single cover frame for the feed thumbnail.
//
// Takes the frame at one second rather than the very first: the opening frame of
// a phone recording is often black or blurred while exposure settles. Falls back
// to the first frame for clips shorter than that.
func (e *Extractor) ExtractCover(ctx context.Context, path, destPath string, width int) error {
	if _, err := exec.LookPath(e.ffmpegPath); err != nil {
		return ErrToolMissing
	}
	if width <= 0 {
		width = 720
	}

	cmdCtx, cancel := context.WithTimeout(ctx, e.timeout)
	defer cancel()

	run := func(seek string) error {
		args := []string{"-v", "error"}
		if seek != "" {
			// -ss before -i seeks without decoding everything up to that point.
			args = append(args, "-ss", seek)
		}
		args = append(args,
			"-i", path,
			"-an",
			"-frames:v", "1",
			"-vf", fmt.Sprintf("scale=%d:-2", width),
			"-q:v", "3",
			"-y",
			destPath,
		)
		cmd := exec.CommandContext(cmdCtx, e.ffmpegPath, args...)
		if out, err := cmd.CombinedOutput(); err != nil {
			return fmt.Errorf("ffmpeg cover: %v: %s", err, strings.TrimSpace(string(out)))
		}
		if st, err := os.Stat(destPath); err != nil || st.Size() == 0 {
			return ErrNoFrames
		}
		return nil
	}

	if err := run("00:00:01"); err == nil {
		return nil
	}
	// Clip shorter than a second, or seeking failed: take whatever the first
	// frame is.
	return run("")
}
