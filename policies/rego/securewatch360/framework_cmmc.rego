package securewatch.cmmc

cmmc_cui_context {
  input.category != null
  is_string(input.category)
  s := lower(input.category)
  contains(s, "cmmc")
}

cmmc_cui_context {
  input.category != null
  is_string(input.category)
  s := lower(input.category)
  contains(s, "cui")
}

cmmc_cui_context {
  input.category != null
  is_string(input.category)
  s := lower(input.category)
  contains(s, "defense")
}

strict_review {
  cmmc_cui_context
  input.severity == "critical"
  input.exposure == "internet"
}
