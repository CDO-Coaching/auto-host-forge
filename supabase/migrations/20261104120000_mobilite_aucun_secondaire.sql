update exercise_library
set muscles_second = array['AUCUN']::muscle_group[]
where category::text ilike '%mobilit%'
  and (muscles_second is null or cardinality(muscles_second) = 0);
