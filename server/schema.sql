CREATE TABLE IF NOT EXISTS users (
 id SERIAL PRIMARY KEY, email TEXT NOT NULL UNIQUE, "passwordHash" TEXT NOT NULL,
 name TEXT NOT NULL, "contactPhone" TEXT NOT NULL DEFAULT '', role TEXT NOT NULL DEFAULT 'client' CHECK(role IN ('client','admin','manager'))
);
CREATE TABLE IF NOT EXISTS libraries (
 id SERIAL PRIMARY KEY, name TEXT NOT NULL, address TEXT NOT NULL, description TEXT NOT NULL DEFAULT '',
 "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(), "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS books (
 id SERIAL PRIMARY KEY, "libraryId" INTEGER NOT NULL REFERENCES libraries(id), title TEXT NOT NULL, author TEXT NOT NULL,
 year INTEGER, description TEXT NOT NULL DEFAULT '', "coverImage" TEXT NOT NULL DEFAULT '',
 "isAvailable" BOOLEAN NOT NULL DEFAULT true, "totalCopies" INTEGER NOT NULL DEFAULT 1 CHECK("totalCopies">=0),
 "availableCopies" INTEGER NOT NULL DEFAULT 1 CHECK("availableCopies">=0 AND "availableCopies"<="totalCopies"),
 "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(), "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS rentals (
 id SERIAL PRIMARY KEY, "userId" INTEGER NOT NULL REFERENCES users(id), "libraryId" INTEGER NOT NULL REFERENCES libraries(id),
 "bookId" INTEGER NOT NULL REFERENCES books(id), "dateStart" TIMESTAMPTZ NOT NULL, "dateEnd" TIMESTAMPTZ NOT NULL,
 status TEXT NOT NULL DEFAULT 'reserved' CHECK(status IN ('reserved','active','completed','cancelled')),
 "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(), "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(), CHECK("dateEnd">"dateStart")
);
CREATE INDEX IF NOT EXISTS rental_availability ON rentals("bookId","dateStart","dateEnd") WHERE status IN ('reserved','active');
CREATE TABLE IF NOT EXISTS support_requests (
 id SERIAL PRIMARY KEY, "userId" INTEGER NOT NULL REFERENCES users(id), "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(), "isActive" BOOLEAN NOT NULL DEFAULT true
);
CREATE TABLE IF NOT EXISTS messages (
 id SERIAL PRIMARY KEY, "supportRequest" INTEGER NOT NULL REFERENCES support_requests(id) ON DELETE CASCADE,
 "authorId" INTEGER NOT NULL REFERENCES users(id), "sentAt" TIMESTAMPTZ NOT NULL DEFAULT now(), text TEXT NOT NULL, "readAt" TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS messages_chat ON messages("supportRequest",id);
-- Compatibility names from the task's domain models; existing numeric IDs remain stable.
ALTER TABLE users ADD COLUMN IF NOT EXISTS _id INTEGER GENERATED ALWAYS AS (id) STORED NOT NULL UNIQUE;
ALTER TABLE support_requests ADD COLUMN IF NOT EXISTS _id INTEGER GENERATED ALWAYS AS (id) STORED NOT NULL UNIQUE;
ALTER TABLE support_requests ADD COLUMN IF NOT EXISTS "user" INTEGER GENERATED ALWAYS AS ("userId") STORED NOT NULL;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS _id INTEGER GENERATED ALWAYS AS (id) STORED NOT NULL UNIQUE;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS author INTEGER GENERATED ALWAYS AS ("authorId") STORED NOT NULL;
-- Group coincident endpoints before summing: return and pickup may share a date.
CREATE OR REPLACE FUNCTION free_copies(p_book INTEGER,p_start TIMESTAMPTZ,p_end TIMESTAMPTZ)
RETURNS INTEGER LANGUAGE SQL STABLE AS $$
 SELECT GREATEST(0,b."totalCopies"-COALESCE((
  SELECT MAX(load)::int FROM (
   SELECT SUM(delta) OVER(ORDER BY point) AS load FROM (
    SELECT point,SUM(delta) AS delta FROM (
     SELECT GREATEST(r."dateStart",p_start) AS point,1 AS delta FROM rentals r WHERE r."bookId"=p_book AND r.status IN ('reserved','active') AND r."dateStart"<p_end AND r."dateEnd">p_start
     UNION ALL
     SELECT LEAST(r."dateEnd",p_end) AS point,-1 AS delta FROM rentals r WHERE r."bookId"=p_book AND r.status IN ('reserved','active') AND r."dateStart"<p_end AND r."dateEnd">p_start
    ) events GROUP BY point
   ) grouped
  ) running
 ),0))::int FROM books b WHERE b.id=p_book
$$;
