# Smoke test for `opa test` in CI; documents that example_decision package loads.
package securewatch.example_test

import data.securewatch.example

test_example_placeholder if {
	example.placeholder == true
}
