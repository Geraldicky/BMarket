-- New listings are Meetup-only. Legacy transaction delivery columns and enum
-- values remain intact so historical courier transactions stay readable.
ALTER TABLE "listings"
  ALTER COLUMN "fulfillmentMethods"
  SET DEFAULT ARRAY['CAMPUS_MEETUP']::"FulfillmentMethod"[];

UPDATE "listings"
SET "fulfillmentMethods" = CASE
  WHEN "mode" = 'SERVICE' THEN ARRAY[]::"FulfillmentMethod"[]
  ELSE ARRAY['CAMPUS_MEETUP']::"FulfillmentMethod"[]
END
WHERE "fulfillmentMethods" IS DISTINCT FROM CASE
  WHEN "mode" = 'SERVICE' THEN ARRAY[]::"FulfillmentMethod"[]
  ELSE ARRAY['CAMPUS_MEETUP']::"FulfillmentMethod"[]
END;
