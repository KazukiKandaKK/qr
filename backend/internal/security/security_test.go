package security

import (
	"testing"
	"time"

	"github.com/KazukiKandaKK/qr/backend/internal/domain"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestBcryptHasher_HashAndCompare(t *testing.T) {
	h := NewBcryptHasher(10)
	hash, err := h.Hash("Password1")
	require.NoError(t, err)
	assert.NotEmpty(t, hash)

	assert.NoError(t, h.Compare("Password1", hash))
	assert.Error(t, h.Compare("wrong", hash))
}

func TestBcryptHasher_WeakPasswordRejected(t *testing.T) {
	h := NewBcryptHasher(10)
	_, err := h.Hash("weak")
	assert.Error(t, err)
	_, err = h.Hash("onlylowercase1")
	assert.Error(t, err)
	_, err = h.Hash("ONLYUPPERCASE1")
	assert.Error(t, err)
	_, err = h.Hash("NoNumbersAbc")
	assert.Error(t, err)
}

func TestJWTIssuer_IssueAndVerify(t *testing.T) {
	issuer := NewJWTIssuer("test-secret-test-secret-test-secret-test", time.Hour)
	token, err := issuer.Issue(domain.User{ID: "u-1", Email: "a@example.com", Role: domain.RoleAdmin})
	require.NoError(t, err)
	assert.NotEmpty(t, token)

	user, err := issuer.Verify(token)
	require.NoError(t, err)
	assert.Equal(t, "u-1", user.ID)
	assert.Equal(t, "a@example.com", user.Email)
	assert.Equal(t, domain.RoleAdmin, user.Role)

	_, err = issuer.Verify("invalid-token")
	assert.Error(t, err)
}
