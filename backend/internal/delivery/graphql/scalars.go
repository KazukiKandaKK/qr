package graphql

import (
	"encoding/json"
	"errors"
	"fmt"
	"time"
)

type DateTime struct {
	time.Time
}

func (DateTime) ImplementsGraphQLType(name string) bool {
	return name == "DateTime"
}

func (d *DateTime) UnmarshalGraphQL(input any) error {
	switch input := input.(type) {
	case DateTime:
		d.Time = input.Time
		return nil
	case *DateTime:
		d.Time = input.Time
		return nil
	case time.Time:
		d.Time = input
		return nil
	case string:
		t, err := time.Parse(time.RFC3339, input)
		if err != nil {
			return err
		}
		d.Time = t
		return nil
	case []byte:
		t, err := time.Parse(time.RFC3339, string(input))
		if err != nil {
			return err
		}
		d.Time = t
		return nil
	default:
		return fmt.Errorf("wrong type for DateTime: %T", input)
	}
}

func (d DateTime) MarshalJSON() ([]byte, error) {
	return json.Marshal(d.Time)
}

type Role string

const (
	RoleAdmin Role = "ADMIN"
	RoleUser  Role = "USER"
)

func (Role) ImplementsGraphQLType(name string) bool {
	return name == "Role"
}

func (r *Role) UnmarshalGraphQL(input any) error {
	switch input := input.(type) {
	case Role:
		*r = input
		return nil
	case string:
		if input != "ADMIN" && input != "USER" {
			return fmt.Errorf("invalid role: %s", input)
		}
		*r = Role(input)
		return nil
	default:
		return errors.New("role must be a string")
	}
}

func (r Role) MarshalJSON() ([]byte, error) {
	return json.Marshal(string(r))
}
