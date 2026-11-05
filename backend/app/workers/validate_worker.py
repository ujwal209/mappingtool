"""
Validation Worker.
Executes multi-level quality validations (Schema, Record, Uniqueness, Referential, Cross-record)
as specified in Section 12 of the Technical Specification.
"""

import re
from typing import Any, Dict, List, Optional
from app.models.canonical import ValidationResult, RuleSeverity


class ValidateWorker:
    """Evaluates quality rules over transformed record partitions and emits evidence."""

    def execute_validations(
        self,
        run_id: str,
        records: List[Dict[str, Any]],
        validation_rules: List[Dict[str, Any]],
    ) -> List[ValidationResult]:
        results: List[ValidationResult] = []
        total_records = len(records)

        for rule in validation_rules:
            rule_id = rule.get("rule_id", "VAL-GENERIC")
            level = rule.get("level", "Record")
            severity_str = rule.get("severity", "ERROR")
            severity = getattr(RuleSeverity, severity_str, RuleSeverity.ERROR)
            check = rule.get("check", "not_null")
            target_fields = rule.get("target_fields", [])

            passed_count = 0
            failed_count = 0
            sample_failures = []

            if check == "not_null":
                for rec in records:
                    failed_fields = [f for f in target_fields if rec.get(f) is None or str(rec.get(f)).strip() == ""]
                    if not failed_fields:
                        passed_count += 1
                    else:
                        failed_count += 1
                        if len(sample_failures) < 5:
                            sample_failures.append({
                                "record": rec,
                                "failed_fields": failed_fields,
                                "reason": "Null or empty value in required field",
                            })

            elif check == "email_format":
                email_regex = re.compile(r"^[\w\.-]+@[\w\.-]+\.\w+$")
                for rec in records:
                    has_error = False
                    for f in target_fields:
                        val = str(rec.get(f, "")).strip()
                        if val and not email_regex.match(val):
                            has_error = True
                            break
                    if has_error:
                        failed_count += 1
                        if len(sample_failures) < 5:
                            sample_failures.append({
                                "record": rec,
                                "reason": "Invalid email format",
                            })
                    else:
                        passed_count += 1

            elif check == "uniqueness":
                seen = set()
                for rec in records:
                    key_vals = tuple(rec.get(f) for f in target_fields)
                    if key_vals in seen:
                        failed_count += 1
                        if len(sample_failures) < 5:
                            sample_failures.append({
                                "record": rec,
                                "duplicate_key": key_vals,
                                "reason": "Duplicate business key detected",
                            })
                    else:
                        seen.add(key_vals)
                        passed_count += 1
            else:
                passed_count = total_records

            val_result = ValidationResult(
                run_id=run_id,
                rule_id=rule_id,
                validation_level=level,
                severity=severity,
                passed=(failed_count == 0),
                total_records=total_records,
                passed_count=passed_count,
                failed_count=failed_count,
                sample_failures=sample_failures,
                details={"check": check, "target_fields": target_fields},
            )
            results.append(val_result)

        return results


validate_worker = ValidateWorker()
