package sqlc

// DB returns the underlying database transaction/connection pool runner.
func (q *Queries) DB() DBTX {
	return q.db
}
