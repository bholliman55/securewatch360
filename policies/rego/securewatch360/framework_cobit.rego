package securewatch.cobit

cobit_context if {
  input.category != null
  is_string(input.category)
  s := lower(input.category)
  contains(s, "cobit")
}

strict_review if {
  cobit_context
  input.severity == "critical"
}
