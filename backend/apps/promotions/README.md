Promotions module
=================

This module provides:

- `PromotionBatch`, `PromotionAssignment`, `PromotionAudit`, `AcademicHistory` models
- Utilities: `generate_promotion_suggestions`, `commit_promotions`, `revert_promotions`
- DRF viewsets and endpoints: `batches`, `assignments`, allocation & commit endpoints
- Management command: `backfill_academic_history` to populate historical records from enrollments and report cards

Quick commands:

Run tests for promotions:

```bash
cd backend
venv\Scripts\python.exe manage.py test apps.promotions
```

Backfill academic history (dry-run):

```bash
venv\Scripts\python.exe manage.py backfill_academic_history --dry-run
```
