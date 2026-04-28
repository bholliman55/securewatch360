package securewatch.fedramp

fedramp_context {
  input.category != null
  is_string(input.category)
  s := lower(input.category)
  contains(s, "fedramp")
}

fedramp_context {
  input.category != null
  is_string(input.category)
  s := lower(input.category)
  contains(s, "fisma")
}

strict_review {
  fedramp_context
  input.severity == "critical"
}
