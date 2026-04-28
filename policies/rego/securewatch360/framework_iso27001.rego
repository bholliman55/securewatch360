package securewatch.iso27001

iso27001_context {
  input.category != null
  is_string(input.category)
  s := lower(input.category)
  contains(s, "iso 27001")
}

iso27001_context {
  input.category != null
  is_string(input.category)
  s := lower(input.category)
  contains(s, "iso27001")
}

strict_review {
  iso27001_context
  input.severity == "critical"
}
