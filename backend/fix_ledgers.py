from apps.finance.models import Transaction, FeeLedger, FeeLedgerEntry
import os
import django

# Setup django environment if needed (though usually manage.py shell handles it)
# Since we are running via manage.py shell, we don't need this.

txns = Transaction.objects.all()
print(f"Total Transactions: {txns.count()}")

for t in txns:
    print(f"Processing Txn {t.id}: Amount {t.amount}, Student {t.student}, Invoice {t.invoice}")
    if not t.student and t.invoice:
        t.student = t.invoice.student
        t.school = t.invoice.school
        t.save()
        print(f"  -> Linked to student {t.student}")
    
    try:
        t._sync_to_ledger()
        print(f"  -> Synced to ledger.")
    except Exception as e:
        print(f"  -> ERROR syncing: {e}")

# Verify entries
entries = FeeLedgerEntry.objects.filter(entry_type='PAYMENT')
print(f"Total Payment Entries Created: {entries.count()}")
for e in entries:
    print(f"  Entry: Ledger {e.ledger.student.user.first_name}, Amount {e.amount}")

# Recalculate all ledgers
for l in FeeLedger.objects.all():
    l.recalculate()
    print(f"Recalculated Ledger for {l.student.user.first_name}: Payments={l.total_payments}, Balance={l.current_balance}")
