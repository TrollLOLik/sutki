package videoframes

import (
	"fmt"
	"image"
	"image/color"
	"image/draw"
	"image/jpeg"
	"os"
	"path/filepath"

	"github.com/nfnt/resize"
)

const (
	contactSheetColumns = 3
	contactSheetRows    = 2
	contactSheetCellW   = 320
	contactSheetCellH   = 180
)

// ComposeContactSheets groups sampled frames into 3x2 JPEG sheets.
//
// A sheet reduces paid vision calls without changing the server-side sampling
// policy. The frames remain large enough for a vision model to inspect common
// violations, while the black background keeps different aspect ratios stable.
// Each cell is labelled with its global frame number and approximate timestamp
// so a moderation verdict can point to the evidence.
func ComposeContactSheets(framePaths []string, timestamps []int, destDir string, framesPerSheet int) ([]string, error) {
	if len(framePaths) == 0 {
		return nil, ErrNoFrames
	}
	if framesPerSheet <= 0 || framesPerSheet > contactSheetColumns*contactSheetRows {
		framesPerSheet = contactSheetColumns * contactSheetRows
	}
	if err := os.MkdirAll(destDir, 0o700); err != nil {
		return nil, fmt.Errorf("create contact sheet directory: %w", err)
	}

	sheets := make([]string, 0, (len(framePaths)+framesPerSheet-1)/framesPerSheet)
	for start := 0; start < len(framePaths); start += framesPerSheet {
		end := start + framesPerSheet
		if end > len(framePaths) {
			end = len(framePaths)
		}

		canvas := image.NewRGBA(image.Rect(0, 0,
			contactSheetColumns*contactSheetCellW,
			contactSheetRows*contactSheetCellH,
		))
		draw.Draw(canvas, canvas.Bounds(), image.Black, image.Point{}, draw.Src)

		for i, path := range framePaths[start:end] {
			file, err := os.Open(path)
			if err != nil {
				return nil, fmt.Errorf("open frame %q: %w", path, err)
			}
			frame, _, err := image.Decode(file)
			file.Close()
			if err != nil {
				return nil, fmt.Errorf("decode frame %q: %w", path, err)
			}

			thumb := resize.Thumbnail(contactSheetCellW, contactSheetCellH, frame, resize.Lanczos3)
			col := i % contactSheetColumns
			row := i / contactSheetColumns
			cell := image.Rect(
				col*contactSheetCellW,
				row*contactSheetCellH,
				(col+1)*contactSheetCellW,
				(row+1)*contactSheetCellH,
			)
			offset := image.Pt(
				cell.Min.X+(cell.Dx()-thumb.Bounds().Dx())/2,
				cell.Min.Y+(cell.Dy()-thumb.Bounds().Dy())/2,
			)
			draw.Draw(canvas, image.Rectangle{Min: offset, Max: offset.Add(thumb.Bounds().Size())}, thumb, image.Point{}, draw.Over)

			timestamp := 0
			globalIndex := start + i
			if globalIndex < len(timestamps) && timestamps[globalIndex] > 0 {
				timestamp = timestamps[globalIndex]
			}
			label := fmt.Sprintf("#%d %02d:%02d", globalIndex+1, timestamp/60, timestamp%60)
			drawBitmapLabel(canvas, cell.Min.X+8, cell.Min.Y+8, label)
		}

		path := filepath.Join(destDir, fmt.Sprintf("sheet_%03d.jpg", len(sheets)))
		out, err := os.OpenFile(path, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, 0o600)
		if err != nil {
			return nil, fmt.Errorf("create contact sheet: %w", err)
		}
		err = jpeg.Encode(out, canvas, &jpeg.Options{Quality: 82})
		closeErr := out.Close()
		if err != nil {
			return nil, fmt.Errorf("encode contact sheet: %w", err)
		}
		if closeErr != nil {
			return nil, fmt.Errorf("close contact sheet: %w", closeErr)
		}
		sheets = append(sheets, path)
	}
	return sheets, nil
}

var bitmapGlyphs = map[rune][]string{
	'0': {"111", "101", "101", "101", "111"},
	'1': {"010", "110", "010", "010", "111"},
	'2': {"111", "001", "111", "100", "111"},
	'3': {"111", "001", "111", "001", "111"},
	'4': {"101", "101", "111", "001", "001"},
	'5': {"111", "100", "111", "001", "111"},
	'6': {"111", "100", "111", "101", "111"},
	'7': {"111", "001", "010", "010", "010"},
	'8': {"111", "101", "111", "101", "111"},
	'9': {"111", "101", "111", "001", "111"},
	':': {"0", "1", "0", "1", "0"},
	'#': {"101", "111", "101", "111", "101"},
	' ': {"0", "0", "0", "0", "0"},
}

func drawBitmapLabel(dst *image.RGBA, x, y int, text string) {
	const (
		scale   = 3
		padding = 5
	)
	width := padding * 2
	for _, ch := range text {
		glyph := bitmapGlyphs[ch]
		glyphWidth := 1
		if len(glyph) > 0 {
			glyphWidth = len(glyph[0])
		}
		width += (glyphWidth + 1) * scale
	}
	height := padding*2 + 5*scale

	background := color.RGBA{A: 190}
	draw.Draw(dst, image.Rect(x, y, x+width, y+height), &image.Uniform{C: background}, image.Point{}, draw.Over)
	foreground := color.RGBA{R: 255, G: 255, B: 255, A: 255}
	cursorX := x + padding
	for _, ch := range text {
		glyph := bitmapGlyphs[ch]
		glyphWidth := 1
		if len(glyph) > 0 {
			glyphWidth = len(glyph[0])
		}
		for row, pixels := range glyph {
			for col, pixel := range pixels {
				if pixel != '1' {
					continue
				}
				draw.Draw(dst, image.Rect(
					cursorX+col*scale,
					y+padding+row*scale,
					cursorX+(col+1)*scale,
					y+padding+(row+1)*scale,
				), &image.Uniform{C: foreground}, image.Point{}, draw.Src)
			}
		}
		cursorX += (glyphWidth + 1) * scale
	}
}
