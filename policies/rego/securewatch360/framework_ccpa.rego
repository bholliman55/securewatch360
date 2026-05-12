package securewatch.ccpa

ccpa_context if {
  input.category != null
  is_string(input.category)
  s := lower(input.category)
  contains(s, "ccpa")
}

ccpa_context if {
  input.category != null
  is_string(input.category)
  s := lower(input.category)
  contains(s, "california consumer")
}

strict_review if {
  ccpa_context
  input.severity == "high"
}
