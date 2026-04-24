/*
  # Add RLS policy for user_training_enrollments

  1. Allows reading enrollment data for training module metrics
*/

CREATE POLICY "Allow public read access to training enrollments"
  ON user_training_enrollments
  FOR SELECT
  USING (true);
