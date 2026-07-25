package videoframes

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"testing"
	"time"
)

// requireFFmpeg skips when the binaries are absent: the CI image may not carry
// them, and these tests are about the real subprocess behaviour, not a mock.
func requireFFmpeg(t *testing.T) {
	t.Helper()
	for _, bin := range []string{"ffmpeg", "ffprobe"} {
		if _, err := exec.LookPath(bin); err != nil {
			t.Skipf("%s not installed", bin)
		}
	}
}

// makeVideo renders a synthetic clip with ffmpeg's own test source, so the
// fixture is generated rather than committed as a binary blob.
func makeVideo(t *testing.T, seconds int, width, height int) string {
	t.Helper()
	path := filepath.Join(t.TempDir(), "sample.mp4")
	source := fmt.Sprintf("testsrc=size=%dx%d:rate=25:duration=%d", width, height, seconds)
	cmd := exec.Command("ffmpeg", "-v", "error",
		"-f", "lavfi", "-i", source,
		"-c:v", "libx264", "-pix_fmt", "yuv420p", "-y", path)
	if out, err := cmd.CombinedOutput(); err != nil {
		t.Fatalf("render fixture: %v: %s", err, out)
	}
	return path
}

func TestProbeReadsDurationAndSize(t *testing.T) {
	requireFFmpeg(t)
	e := New(Config{})

	info, err := e.Probe(context.Background(), makeVideo(t, 5, 640, 480))
	if err != nil {
		t.Fatalf("probe: %v", err)
	}
	if !info.HasVideoStream {
		t.Fatal("expected a video stream")
	}
	if info.Width != 640 || info.Height != 480 {
		t.Fatalf("unexpected dimensions: %dx%d", info.Width, info.Height)
	}
	// Duration rounds up, so a 5s clip must never read as 4.
	if info.DurationSeconds < 5 || info.DurationSeconds > 6 {
		t.Fatalf("expected ~5s, got %d", info.DurationSeconds)
	}
}

// A file that is not a video must fail probing rather than be waved through:
// the declared MIME type is client-controlled and cannot be trusted.
func TestProbeRejectsNonVideo(t *testing.T) {
	requireFFmpeg(t)
	e := New(Config{})

	path := filepath.Join(t.TempDir(), "fake.mp4")
	if err := os.WriteFile(path, []byte("this is not a video"), 0o600); err != nil {
		t.Fatal(err)
	}

	if _, err := e.Probe(context.Background(), path); err == nil {
		t.Fatal("expected probe to fail on a non-video file")
	}
}

func TestExtractFramesSamplesAtInterval(t *testing.T) {
	requireFFmpeg(t)
	e := New(Config{})
	dir := t.TempDir()

	// 20 seconds at one frame per 4s => 5 frames.
	frames, err := e.ExtractFrames(context.Background(), makeVideo(t, 20, 640, 360), dir,
		ExtractOptions{IntervalSeconds: 4, MaxFrames: 10, Width: 320})
	if err != nil {
		t.Fatalf("extract: %v", err)
	}
	if len(frames) < 4 || len(frames) > 6 {
		t.Fatalf("expected ~5 frames for a 20s clip at 4s interval, got %d", len(frames))
	}
	for _, f := range frames {
		st, err := os.Stat(f)
		if err != nil || st.Size() == 0 {
			t.Fatalf("frame %s is missing or empty", f)
		}
	}
}

// MaxFrames is the cost ceiling: without it a long upload becomes an unbounded
// number of paid vision calls.
func TestExtractFramesRespectsMaxFrames(t *testing.T) {
	requireFFmpeg(t)
	e := New(Config{})
	dir := t.TempDir()

	// 30s at 1s interval would be 30 frames; the cap must hold it to 3.
	frames, err := e.ExtractFrames(context.Background(), makeVideo(t, 30, 320, 240), dir,
		ExtractOptions{IntervalSeconds: 1, MaxFrames: 3, Width: 160})
	if err != nil {
		t.Fatalf("extract: %v", err)
	}
	if len(frames) != 3 {
		t.Fatalf("expected exactly 3 frames, got %d", len(frames))
	}
}

// Frames must come back in chronological order — the moderation report and the
// frames_checked count are meaningless if the order is arbitrary.
func TestExtractFramesReturnsChronologicalOrder(t *testing.T) {
	requireFFmpeg(t)
	e := New(Config{})
	dir := t.TempDir()

	frames, err := e.ExtractFrames(context.Background(), makeVideo(t, 12, 320, 240), dir,
		ExtractOptions{IntervalSeconds: 2, MaxFrames: 10, Width: 160})
	if err != nil {
		t.Fatalf("extract: %v", err)
	}
	for i := 1; i < len(frames); i++ {
		if filepath.Base(frames[i-1]) >= filepath.Base(frames[i]) {
			t.Fatalf("frames out of order: %s before %s", frames[i-1], frames[i])
		}
	}
}

func TestExtractCoverProducesImage(t *testing.T) {
	requireFFmpeg(t)
	e := New(Config{})
	dest := filepath.Join(t.TempDir(), "cover.jpg")

	if err := e.ExtractCover(context.Background(), makeVideo(t, 6, 1280, 720), dest, 720); err != nil {
		t.Fatalf("cover: %v", err)
	}
	st, err := os.Stat(dest)
	if err != nil || st.Size() == 0 {
		t.Fatal("cover file is missing or empty")
	}
}

// Clips shorter than the 1s seek point must still yield a cover via the
// first-frame fallback, not fail.
func TestExtractCoverFallsBackOnVeryShortClip(t *testing.T) {
	requireFFmpeg(t)
	e := New(Config{})
	dest := filepath.Join(t.TempDir(), "cover.jpg")

	// A sub-second clip: seeking to 00:00:01 lands past the end.
	path := filepath.Join(t.TempDir(), "tiny.mp4")
	cmd := exec.Command("ffmpeg", "-v", "error", "-f", "lavfi",
		"-i", "testsrc=size=320x240:rate=25:duration=0.4",
		"-c:v", "libx264", "-pix_fmt", "yuv420p", "-y", path)
	if out, err := cmd.CombinedOutput(); err != nil {
		t.Fatalf("render tiny fixture: %v: %s", err, out)
	}

	if err := e.ExtractCover(context.Background(), path, dest, 320); err != nil {
		t.Fatalf("expected fallback to succeed: %v", err)
	}
	if st, err := os.Stat(dest); err != nil || st.Size() == 0 {
		t.Fatal("fallback cover is missing or empty")
	}
}

// A hung ffmpeg must not pin a core forever: on a two-core box that starves the
// API process.
func TestTimeoutIsEnforced(t *testing.T) {
	requireFFmpeg(t)
	e := New(Config{Timeout: 1 * time.Millisecond})

	// The fixture is rendered with the default timeout, then probed with the
	// tiny one.
	path := makeVideo(t, 3, 320, 240)
	if _, err := e.Probe(context.Background(), path); err == nil {
		t.Fatal("expected the probe to fail under a 1ms timeout")
	}
}

func TestAvailableDetectsMissingBinary(t *testing.T) {
	if New(Config{FFmpegPath: "definitely-not-a-real-binary-xyz"}).Available() {
		t.Fatal("expected Available to be false for a missing binary")
	}
	requireFFmpeg(t)
	if !New(Config{}).Available() {
		t.Fatal("expected Available to be true when ffmpeg is installed")
	}
}
