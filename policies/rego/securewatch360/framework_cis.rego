package securewatch.cis

cis_controls_context if {
  input.category != null
  is_string(input.category)
  s := lower(input.category)
  contains(s, "cis")
}

strict_review if {
  cis_controls_context
  input.severity == "critical"
}
