package securewatch.hipaa

# HIPAA-oriented triage hints for SecureWatch360 decision inputs.
# Bias automated decisioning when category text suggests ePHI/health context.
# Customize input.category values in your integration to match this logic.

ephi_suspected {
  input.category != null
  is_string(input.category)
  s := lower(input.category)
  contains(s, "phi")
}

ephi_suspected {
  input.category != null
  is_string(input.category)
  s := lower(input.category)
  contains(s, "hipaa")
}

ephi_suspected {
  input.category != null
  is_string(input.category)
  s := lower(input.category)
  contains(s, "health")
}

require_strict_review {
  ephi_suspected
  input.severity == "critical"
}

require_strict_review {
  ephi_suspected
  input.exposure == "internet"
  input.severity == "high"
}
