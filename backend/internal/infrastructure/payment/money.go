package payment

import (
	"fmt"
	"strconv"
	"strings"
)

func formatKopecks(value int32) string {
	return fmt.Sprintf("%d.%02d", value/100, value%100)
}

func parseKopecks(value string) (int32, error) {
	parts := strings.Split(value, ".")
	if len(parts) > 2 || len(parts) == 0 {
		return 0, fmt.Errorf("invalid amount")
	}
	rubles, err := strconv.ParseInt(parts[0], 10, 32)
	if err != nil || rubles < 0 {
		return 0, fmt.Errorf("invalid amount")
	}
	kopecks := int64(0)
	if len(parts) == 2 {
		fraction := parts[1]
		if len(fraction) == 1 {
			fraction += "0"
		}
		if len(fraction) != 2 {
			return 0, fmt.Errorf("invalid amount precision")
		}
		kopecks, err = strconv.ParseInt(fraction, 10, 32)
		if err != nil {
			return 0, fmt.Errorf("invalid amount")
		}
	}
	total := rubles*100 + kopecks
	if total > int64(^uint32(0)>>1) {
		return 0, fmt.Errorf("amount is too large")
	}
	return int32(total), nil
}
