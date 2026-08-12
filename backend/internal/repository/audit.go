package repository

import (
	"encoding/json"
	"time"

	"github.com/KazukiKandaKK/qr/backend/internal/domain"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type AuditRepo struct {
	db *gorm.DB
}

func NewAuditRepository(db *gorm.DB) *AuditRepo {
	return &AuditRepo{db: db}
}

func (r *AuditRepo) toDomain(m AuditLogModel) (domain.AuditLog, error) {
	var metadata map[string]any
	if m.Metadata != "" {
		if err := json.Unmarshal([]byte(m.Metadata), &metadata); err != nil {
			return domain.AuditLog{}, err
		}
	}
	return domain.AuditLog{
		ID:         m.ID,
		Action:     m.Action,
		ActorID:    m.ActorID,
		ActorEmail: m.ActorEmail,
		TargetID:   m.TargetID,
		TargetType: m.TargetType,
		IP:         m.IP,
		UserAgent:  m.UserAgent,
		Metadata:   metadata,
		CreatedAt:  m.CreatedAt,
	}, nil
}

func (r *AuditRepo) Create(input domain.AuditLogInput) (domain.AuditLog, error) {
	metadataJSON := ""
	if input.Metadata != nil {
		b, err := json.Marshal(input.Metadata)
		if err != nil {
			return domain.AuditLog{}, err
		}
		metadataJSON = string(b)
	}
	m := AuditLogModel{
		ID:         uuid.New().String(),
		Action:     input.Action,
		ActorID:    input.ActorID,
		ActorEmail: input.ActorEmail,
		TargetID:   input.TargetID,
		TargetType: input.TargetType,
		IP:         input.IP,
		UserAgent:  input.UserAgent,
		Metadata:   metadataJSON,
		CreatedAt:  time.Now(),
	}
	if err := r.db.Create(&m).Error; err != nil {
		return domain.AuditLog{}, err
	}
	return r.toDomain(m)
}

func (r *AuditRepo) FindRecent(limit, offset int) ([]domain.AuditLog, error) {
	var rows []AuditLogModel
	if err := r.db.Order("created_at desc").Limit(limit).Offset(offset).Find(&rows).Error; err != nil {
		return nil, err
	}
	logs := make([]domain.AuditLog, len(rows))
	for i, row := range rows {
		log, err := r.toDomain(row)
		if err != nil {
			return nil, err
		}
		logs[i] = log
	}
	return logs, nil
}

func (r *AuditRepo) FindByActorID(actorID string, limit, offset int) ([]domain.AuditLog, error) {
	var rows []AuditLogModel
	if err := r.db.Where("actor_id = ?", actorID).Order("created_at desc").Limit(limit).Offset(offset).Find(&rows).Error; err != nil {
		return nil, err
	}
	logs := make([]domain.AuditLog, len(rows))
	for i, row := range rows {
		log, err := r.toDomain(row)
		if err != nil {
			return nil, err
		}
		logs[i] = log
	}
	return logs, nil
}

func (r *AuditRepo) DeleteByActorID(actorID string) error {
	return r.db.Delete(&AuditLogModel{}, "actor_id = ?", actorID).Error
}
