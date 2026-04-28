package securewatch.cobit

cobit_context {
  input.category != null
  is_string(input.category)
  s := lower(input.category)
  contains(s, "cobit")
}

strict_review {
  cobit_context
  input.severity == "critical"
}
