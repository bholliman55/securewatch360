package securewatch.pci

pci_cardholder_context {
  input.category != null
  is_string(input.category)
  s := lower(input.category)
  contains(s, "pci")
}

pci_cardholder_context {
  input.category != null
  is_string(input.category)
  s := lower(input.category)
  contains(s, "payment")
}

pci_cardholder_context {
  input.category != null
  is_string(input.category)
  s := lower(input.category)
  contains(s, "cardholder")
}

strict_review {
  pci_cardholder_context
  input.severity == "high"
}
