import fs from 'fs';

const file = 'supabase/migrations/20260224000002_wasel_complete_schema.sql';
let content = fs.readFileSync( file, 'utf8' );

const additionalCols = `
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'reviews') THEN
    ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS rating INTEGER;
    ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS review TEXT;
    ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS is_anonymous BOOLEAN DEFAULT FALSE;
    ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS review_type TEXT;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'messages') THEN
    ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS message TEXT;
    ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'notifications') THEN
    ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}';
  END IF;
`;

content = content.replace( 'END $$;', additionalCols + '\nEND $$;' );
fs.writeFileSync( file, content, 'utf8' );
console.log( 'Added reviews/messages/notifications columns to wasel_complete_schema' );

