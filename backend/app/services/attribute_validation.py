from fastapi import HTTPException

def validate_annotation_attributes(label_attrs: list, ann_attrs: list) -> list:
    """
    label_attrs: list of AttributeDef dicts from the label schema
    ann_attrs: list of {"name": "...", "value": ...} dicts provided in the request
    Returns a normalized list of {"name": "...", "value": ...} missing default values injected.
    Raises HTTPException 422 on invalid values.
    """
    normalized = []
    provided = {a["name"]: a["value"] for a in ann_attrs}

    for defn in label_attrs:
        name = defn["name"]
        itype = defn["input_type"]
        val = provided.get(name)

        if val is None:
            if defn.get("required"):
                raise HTTPException(422, f"Attribute '{name}' is required")
            val = defn.get("default")
            if val is None:
                continue

        if itype in ("select", "radio"):
            if val not in defn.get("values", []):
                raise HTTPException(422, f"Invalid value '{val}' for attribute '{name}'. Must be one of {defn.get('values')}")
            normalized.append({"name": name, "value": val})
        elif itype == "checkbox":
            if not isinstance(val, bool):
                raise HTTPException(422, f"Attribute '{name}' must be boolean")
            normalized.append({"name": name, "value": val})
        elif itype == "number":
            try:
                num_val = float(val)
                normalized.append({"name": name, "value": num_val})
            except (ValueError, TypeError):
                raise HTTPException(422, f"Attribute '{name}' must be a number")
        elif itype == "text":
            normalized.append({"name": name, "value": str(val)})
            
    # Include unknown attributes if they were passed, or just ignore them?
    # Usually it's better to drop them, but Annotra might want to preserve them for forward compatibility.
    # We'll drop them to ensure schema strictness.
    return normalized
