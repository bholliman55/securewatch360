package securewatch.fedramp

fedramp_context if {
  input.category != null
  is_string(input.category)
  s := lower(input.category)
  contains(s, "fedramp")
}

fedramp_context if {
  input.category != null
  is_string(input.category)
  s := lower(input.category)
  contains(s, "fisma")
}

strict_review if {
  fedramp_context
  input.severity == "critical"
}
