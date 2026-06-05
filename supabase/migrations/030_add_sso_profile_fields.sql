-- SSO: 业务系统用户与本地 profiles 映射
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS external_login_id TEXT,
  ADD COLUMN IF NOT EXISTS external_source TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_external_login_id
  ON public.profiles (external_login_id)
  WHERE external_login_id IS NOT NULL;

COMMENT ON COLUMN public.profiles.external_login_id IS '业务系统用户标识（login_id）';
COMMENT ON COLUMN public.profiles.external_source IS '外部身份来源，如 business';
