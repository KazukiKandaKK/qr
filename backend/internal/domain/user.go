package domain

import "time"

type Role string

const (
	RoleAdmin Role = "ADMIN"
	RoleUser  Role = "USER"
)

type User struct {
	ID        string
	Email     string
	Name      *string
	Role      Role
	CreatedAt time.Time
	UpdatedAt time.Time
}

type UserWithCredentials struct {
	User
	PasswordHash        string
	FailedLoginAttempts int
	LockedUntil         *time.Time
}

type RegisterInput struct {
	Email    string
	Password string
	Name     *string
}

type LoginInput struct {
	Email    string
	Password string
}

type AuthPayload struct {
	Token string
	User  User
}
