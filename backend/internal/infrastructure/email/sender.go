package email

import (
	"crypto/rand"
	"crypto/tls"
	"encoding/hex"
	"fmt"
	"mime"
	"net/mail"
	"net/smtp"
	"strings"
	"time"
)

// Sender delivers a single rendered email. Implemented by SMTPSender; the
// interface exists so the outbox worker can be tested without a mail server
// and so the transport can later be swapped for a transactional email API
// without touching the queue.
type Sender interface {
	Send(to, subject, textBody, htmlBody string) error
	// Configured reports whether the transport has credentials. When false,
	// the mailer skips enqueueing entirely (mirrors the previous behavior of
	// gating on SMTP_USERNAME/SMTP_PASSWORD).
	Configured() bool
}

// SMTPSender sends mail over implicit TLS (Yandex 360: smtp.yandex.ru:465).
// This is the previous per-usecase sendEmail() consolidated in one place,
// extended with multipart/alternative (text + HTML), Message-ID and Date
// headers for deliverability.
type SMTPSender struct {
	host     string
	port     int
	username string
	password string
	from     string
}

func NewSMTPSender(host string, port int, username, password, from string) *SMTPSender {
	return &SMTPSender{host: host, port: port, username: username, password: password, from: from}
}

func (s *SMTPSender) Configured() bool {
	return s.username != "" && s.password != ""
}

func (s *SMTPSender) Send(to, subject, textBody, htmlBody string) error {
	addr := fmt.Sprintf("%s:%d", s.host, s.port)

	tlsConfig := &tls.Config{
		InsecureSkipVerify: false,
		ServerName:         s.host,
	}
	conn, err := tls.Dial("tcp", addr, tlsConfig)
	if err != nil {
		return fmt.Errorf("tls dial: %w", err)
	}
	defer conn.Close()

	client, err := smtp.NewClient(conn, s.host)
	if err != nil {
		return fmt.Errorf("smtp client: %w", err)
	}
	defer client.Close()

	auth := smtp.PlainAuth("", s.username, s.password, s.host)
	if err = client.Auth(auth); err != nil {
		return fmt.Errorf("auth: %w", err)
	}

	// Clean single quotes if present (e.g. from .env file representation).
	fromCleaned := strings.TrimSpace(s.from)
	if len(fromCleaned) >= 2 && fromCleaned[0] == '\'' && fromCleaned[len(fromCleaned)-1] == '\'' {
		fromCleaned = fromCleaned[1 : len(fromCleaned)-1]
	}
	fromCleaned = strings.TrimSpace(fromCleaned)

	fromParsed, err := mail.ParseAddress(fromCleaned)
	if err != nil {
		return fmt.Errorf("parse sender address: %w", err)
	}

	if err = client.Mail(fromParsed.Address); err != nil {
		return fmt.Errorf("mail: %w", err)
	}
	if err = client.Rcpt(to); err != nil {
		return fmt.Errorf("rcpt: %w", err)
	}

	writer, err := client.Data()
	if err != nil {
		return fmt.Errorf("data: %w", err)
	}
	defer writer.Close()

	msg, err := buildMessage(fromParsed, to, subject, textBody, htmlBody)
	if err != nil {
		return err
	}
	if _, err = writer.Write([]byte(msg)); err != nil {
		return fmt.Errorf("write: %w", err)
	}
	return nil
}

// buildMessage assembles RFC 5322 headers plus a multipart/alternative body
// (plain text first, HTML second) so clients pick the richest part they
// support. Falls back to a single text/plain part when htmlBody is empty.
func buildMessage(from *mail.Address, to, subject, textBody, htmlBody string) (string, error) {
	var fromHeader string
	if from.Name != "" {
		// MIME-encode the display name to support Cyrillic characters.
		fromHeader = fmt.Sprintf("%s <%s>", mime.BEncoding.Encode("utf-8", from.Name), from.Address)
	} else {
		fromHeader = from.Address
	}
	subjectHeader := mime.BEncoding.Encode("utf-8", subject)

	msgID, err := messageID(from.Address)
	if err != nil {
		return "", err
	}

	var b strings.Builder
	fmt.Fprintf(&b, "From: %s\r\n", fromHeader)
	fmt.Fprintf(&b, "To: %s\r\n", to)
	fmt.Fprintf(&b, "Subject: %s\r\n", subjectHeader)
	fmt.Fprintf(&b, "Date: %s\r\n", time.Now().Format(time.RFC1123Z))
	fmt.Fprintf(&b, "Message-ID: %s\r\n", msgID)
	b.WriteString("MIME-Version: 1.0\r\n")

	if htmlBody == "" {
		b.WriteString("Content-Type: text/plain; charset=UTF-8\r\n\r\n")
		b.WriteString(textBody)
		return b.String(), nil
	}

	boundary, err := randomToken()
	if err != nil {
		return "", err
	}
	fmt.Fprintf(&b, "Content-Type: multipart/alternative; boundary=%q\r\n\r\n", boundary)

	fmt.Fprintf(&b, "--%s\r\n", boundary)
	b.WriteString("Content-Type: text/plain; charset=UTF-8\r\n\r\n")
	b.WriteString(textBody)
	b.WriteString("\r\n")

	fmt.Fprintf(&b, "--%s\r\n", boundary)
	b.WriteString("Content-Type: text/html; charset=UTF-8\r\n\r\n")
	b.WriteString(htmlBody)
	b.WriteString("\r\n")

	fmt.Fprintf(&b, "--%s--\r\n", boundary)
	return b.String(), nil
}

func messageID(fromAddr string) (string, error) {
	tok, err := randomToken()
	if err != nil {
		return "", err
	}
	domainPart := "domryadom.local"
	if i := strings.LastIndex(fromAddr, "@"); i >= 0 && i+1 < len(fromAddr) {
		domainPart = fromAddr[i+1:]
	}
	return fmt.Sprintf("<%d.%s@%s>", time.Now().UnixNano(), tok, domainPart), nil
}

func randomToken() (string, error) {
	b := make([]byte, 12)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}
