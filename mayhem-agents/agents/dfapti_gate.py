from dataclasses import dataclass


@dataclass(frozen=True)
class DFAPTIResult:
    allowed: bool
    reason: str
    missing_fields: tuple[str, ...]


REQUIRED_SOURCE_FIELDS = (
    'source_name',
    'source_url',
    'retrieved_at',
    'document_date',
    'authority_level',
    'fact_type',
    'provenance_note',
)

REQUIRED_FACT_FIELDS = (
    'fact_text',
    'source_url',
    'quote_or_extract',
    'confidence',
    'tags',
)


def validate_source_record(record: dict) -> DFAPTIResult:
    missing = tuple(field for field in REQUIRED_SOURCE_FIELDS if not record.get(field))
    if missing:
        return DFAPTIResult(
            allowed=False,
            reason='DFAPTI blocked ingestion: source lacks mandatory provenance/control fields.',
            missing_fields=missing,
        )
    return DFAPTIResult(
        allowed=True,
        reason='DFAPTI passed: source contains mandatory provenance/control fields.',
        missing_fields=(),
    )


def validate_fact_record(record: dict) -> DFAPTIResult:
    missing = tuple(field for field in REQUIRED_FACT_FIELDS if not record.get(field))
    if missing:
        return DFAPTIResult(
            allowed=False,
            reason='DFAPTI blocked memory write: fact lacks mandatory evidence fields.',
            missing_fields=missing,
        )
    return DFAPTIResult(
        allowed=True,
        reason='DFAPTI passed: fact contains mandatory evidence fields.',
        missing_fields=(),
    )
