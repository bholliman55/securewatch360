/*
  # Add RLS policies for training_modules

  1. Fixes training module data display
  2. RLS was enabled but no policies existed, blocking all access
  3. Adding public read policy to allow training module listing
*/

CREATE POLICY "Allow public read access to training modules"
  ON training_modules
  FOR SELECT
  USING (true);
