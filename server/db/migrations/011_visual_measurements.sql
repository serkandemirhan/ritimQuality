ALTER TABLE measurement_results DROP CONSTRAINT IF EXISTS measurement_results_characteristic_type_check;
ALTER TABLE measurement_results ADD CONSTRAINT measurement_results_characteristic_type_check
  CHECK(characteristic_type IN('numeric','ok_nok','visual','single_select','multi_select'));
