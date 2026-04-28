package securewatch.soc2

soc2_trust_context {
  input.category != null
  is_string(input.category)
  s := lower(input.category)
  contains(s, "soc2")
}

soc2_trust_context {
  input.category != null
  is_string(input.category)
  s := lower(input.category)
  contains(s, "soc 2")
}

strict_review {
  soc2_trust_context
  input.severity == "critical"
}
