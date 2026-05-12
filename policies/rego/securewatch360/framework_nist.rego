package securewatch.nist

nist_security_context if {
  input.category != null
  is_string(input.category)
  s := lower(input.category)
  contains(s, "nist")
}

nist_security_context if {
  input.category != null
  is_string(input.category)
  s := lower(input.category)
  contains(s, "800-53")
}

strict_review if {
  nist_security_context
  input.severity == "critical"
}
