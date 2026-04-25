# Monitoring: container image findings on high severity
package securewatch.monitoring

default monitor = false

monitor {
  input.severity == "high"
  input.targetType == "container_image"
}
