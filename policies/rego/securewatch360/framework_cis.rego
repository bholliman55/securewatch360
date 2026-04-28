package securewatch.cis

cis_controls_context {
  input.category != null
  is_string(input.category)
  s := lower(input.category)
  contains(s, "cis")
}

strict_review {
  cis_controls_context
  input.severity == "critical"
}
