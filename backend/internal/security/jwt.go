package security

import (
	"errors"
	"time"

	"github.com/KazukiKandaKK/qr/backend/internal/domain"
	"github.com/golang-jwt/jwt/v5"
)

type JWTIssuer struct {
	secret   []byte
	duration time.Duration
}

type jwtClaims struct {
	Email string      `json:"email"`
	Role  domain.Role `json:"role"`
	jwt.RegisteredClaims
}

func NewJWTIssuer(secret string, duration time.Duration) *JWTIssuer {
	return &JWTIssuer{secret: []byte(secret), duration: duration}
}

func (i *JWTIssuer) Issue(user domain.User) (string, error) {
	now := time.Now()
	claims := jwtClaims{
		Email: user.Email,
		Role:  user.Role,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   user.ID,
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(i.duration)),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(i.secret)
}

func (i *JWTIssuer) Verify(tokenString string) (domain.User, error) {
	token, err := jwt.ParseWithClaims(tokenString, &jwtClaims{}, func(token *jwt.Token) (any, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("unexpected signing method")
		}
		return i.secret, nil
	})
	if err != nil {
		return domain.User{}, err
	}
	claims, ok := token.Claims.(*jwtClaims)
	if !ok || !token.Valid {
		return domain.User{}, errors.New("invalid token")
	}
	return domain.User{
		ID:    claims.Subject,
		Email: claims.Email,
		Role:  claims.Role,
	}, nil
}
