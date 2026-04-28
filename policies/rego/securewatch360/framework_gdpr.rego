package securewatch.gdpr

gdpr_processing_context if {
  input.category != null
  is_string(input.category)
  s := lower(input.category)
  contains(s, "gdpr")
}

gdpr_processing_context if {
  input.category != null
  is_string(input.category)
  s := lower(input.category)
  contains(s, "personal data")
}

gdpr_processing_context if {
  input.category != null
  is_string(input.category)
  s := lower(input.category)
  contains(s, "data subject")
}

strict_review if {
  gdpr_processing_context
  input.severity == "critical"
}
