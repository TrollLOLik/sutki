package videoframes

import (
	"image"
	"image/color"
	"image/jpeg"
	"os"
	"path/filepath"
	"testing"
)

func TestComposeContactSheetsBuildsThreeByTwoPages(t *testing.T) {
	sourceDir := t.TempDir()
	frames := make([]string, 0, 12)
	for i := 0; i < 12; i++ {
		path := filepath.Join(sourceDir, "frame-"+string(rune('a'+i))+".jpg")
		file, err := os.Create(path)
		if err != nil {
			t.Fatal(err)
		}
		frame := image.NewRGBA(image.Rect(0, 0, 640, 360))
		for y := 0; y < 360; y++ {
			for x := 0; x < 640; x++ {
				frame.Set(x, y, color.RGBA{R: uint8(i * 15), G: 80, B: 160, A: 255})
			}
		}
		if err := jpeg.Encode(file, frame, &jpeg.Options{Quality: 75}); err != nil {
			file.Close()
			t.Fatal(err)
		}
		if err := file.Close(); err != nil {
			t.Fatal(err)
		}
		frames = append(frames, path)
	}

	timestamps := []int{0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55}
	sheets, err := ComposeContactSheets(frames, timestamps, t.TempDir(), 6)
	if err != nil {
		t.Fatal(err)
	}
	if len(sheets) != 2 {
		t.Fatalf("expected two sheets for 12 frames, got %d", len(sheets))
	}

	for _, path := range sheets {
		file, err := os.Open(path)
		if err != nil {
			t.Fatal(err)
		}
		sheet, _, err := image.Decode(file)
		file.Close()
		if err != nil {
			t.Fatal(err)
		}
		if got, want := sheet.Bounds().Size(), image.Pt(960, 360); got != want {
			t.Fatalf("sheet size=%v, want %v", got, want)
		}
		// The top-left label has a dark background, so it must differ from the
		// flat source frame color.
		r, g, b, _ := sheet.At(10, 10).RGBA()
		source := frameColor(0)
		sr, sg, sb, _ := source.RGBA()
		if absDiff(r, sr) < 1000 && absDiff(g, sg) < 1000 && absDiff(b, sb) < 1000 {
			t.Fatal("expected a timestamp label in the first cell")
		}
	}
}

func frameColor(index int) color.Color {
	return color.RGBA{R: uint8(index * 15), G: 80, B: 160, A: 255}
}

func absDiff(a, b uint32) uint32 {
	if a > b {
		return a - b
	}
	return b - a
}
