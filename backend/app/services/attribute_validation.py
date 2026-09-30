from typing import Any
from fastapi import HTTPException, status


def validate_annotation_attributes(
    label_attributes: list[dict],
    annotation_attributes: list[Any],
) -> list[dict]:
    """
    Normalize annotation attributes against the label's schema.
    Accepts either {"name": ..., "value": ...} dicts or a raw dict of values.
    Raises HTTP 422 on any mismatch.
    """
    raw: dict[str, Any] = {}
    for entry in annotation_attributes or []:
        if isinstance(entry, dict) and "name" in entry:
            raw[entry["name"]] = entry.get("value")

    result = []
    for spec in label_attributes or []:
        name = spec["name"]
        itype = spec["input_type"]
        value = raw.get(name, spec.get("default"))

        if spec.get("required") and (value is None or value == ""):
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                f"Attribute '{name}' is required",
            )

        if value is None:
            result.append({"name": name, "value": spec.get("default")})
            continue

        if itype in ("select", "radio"):
            if value not in spec.get("values", []):
                raise HTTPException(
                    status.HTTP_422_UNPROCESSABLE_ENTITY,
                    f"Attribute '{name}' must be one of {spec['values']}",
                )
        elif itype == "checkbox":
            value = bool(value)
        elif itype == "number":
            try:
                value = float(value)
            except (TypeError, ValueError):
                raise HTTPException(422, f"Attribute '{name}' must be a number")
        elif itype == "text":
            value = str(value)[:1000]

        result.append({"name": name, "value": value})

    return result