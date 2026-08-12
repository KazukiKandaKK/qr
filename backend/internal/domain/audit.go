package domain

import "time"

type AuditLog struct {
	ID        string
	Action    string
	ActorID   *string
	ActorEmail *string
	TargetID  *string
	TargetType *string
	IP        *string
	UserAgent *string
	Metadata  map[string]any
	CreatedAt time.Time
}

type AuditLogInput struct {
	Action     string
	ActorID    *string
	ActorEmail *string
	TargetID   *string
	TargetType *string
	IP         *string
	UserAgent  *string
	Metadata   map[string]any
}
