package securewatch.pci

pci_cardholder_context if {
  input.category != null
  is_string(input.category)
  s := lower(input.category)
  contains(s, "pci")
}

pci_cardholder_context if {
  input.category != null
  is_string(input.category)
  s := lower(input.category)
  contains(s, "payment")
}

pci_cardholder_context if {
  input.category != null
  is_string(input.category)
  s := lower(input.category)
  contains(s, "cardholder")
}

strict_review if {
  pci_cardholder_context
  input.severity == "high"
}
