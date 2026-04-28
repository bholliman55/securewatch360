package securewatch.ccpa

ccpa_context {
  input.category != null
  is_string(input.category)
  s := lower(input.category)
  contains(s, "ccpa")
}

ccpa_context {
  input.category != null
  is_string(input.category)
  s := lower(input.category)
  contains(s, "california consumer")
}

strict_review {
  ccpa_context
  input.severity == "high"
}
