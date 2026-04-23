-- BeerLab 数据库 Schema
-- 创建时间: 2026-04-22

-- 1. 用户资料表 (扩展 auth.users)
CREATE TABLE profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    username TEXT UNIQUE,
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 啤酒库表
CREATE TABLE beers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    name_en TEXT,
    tag TEXT,  -- 如 IPA, Stout, Lager 等
    style TEXT,  -- 风格描述
    abv DECIMAL(3,1),  -- 酒精度
    ibu INTEGER,  -- 苦度
    description TEXT,
    image_url TEXT,
    color TEXT,  -- 酒体颜色
    flavor_tags TEXT[],  -- 风味标签数组
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 用户收藏的啤酒
CREATE TABLE user_beers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    beer_id UUID REFERENCES beers(id) ON DELETE CASCADE,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),  -- 评分 1-5
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, beer_id)
);

-- 4. 饮酒记录
CREATE TABLE drank_records (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    beer_id UUID REFERENCES beers(id) ON DELETE SET NULL,
    mood TEXT,  -- 当时心情
    location TEXT,  -- 饮酒地点
    companions TEXT[],  -- 同行人
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    notes TEXT,
    drank_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. 好友关系
CREATE TABLE friendships (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    friend_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'blocked')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, friend_id)
);

-- 6. 游戏记录
CREATE TABLE game_records (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    game_type TEXT NOT NULL,  -- 'monster', 'wheel', 'mbti', 'mood'
    score INTEGER,
    result JSONB,  -- 游戏结果详情
    played_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. 邀请码表 (用于好友邀请)
CREATE TABLE invite_codes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    creator_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    used_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    used_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 索引优化
CREATE INDEX idx_user_beers_user ON user_beers(user_id);
CREATE INDEX idx_drank_records_user ON drank_records(user_id);
CREATE INDEX idx_drank_records_drank_at ON drank_records(drank_at);
CREATE INDEX idx_friendships_user ON friendships(user_id);
CREATE INDEX idx_friendships_friend ON friendships(friend_id);
CREATE INDEX idx_game_records_user ON game_records(user_id);

-- Row Level Security (RLS) 策略
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_beers ENABLE ROW LEVEL SECURITY;
ALTER TABLE drank_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_records ENABLE ROW LEVEL SECURITY;

-- profiles: 用户只能查看和修改自己的资料
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- user_beers: 用户只能操作自己的收藏
CREATE POLICY "Users can view own beers" ON user_beers FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own beers" ON user_beers FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own beers" ON user_beers FOR DELETE USING (auth.uid() = user_id);

-- drank_records: 用户只能操作自己的记录
CREATE POLICY "Users can view own records" ON drank_records FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own records" ON drank_records FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own records" ON drank_records FOR UPDATE USING (auth.uid() = user_id);

-- friendships: 好友关系策略
CREATE POLICY "Users can view accepted friendships" ON friendships FOR SELECT 
    USING (auth.uid() = user_id OR auth.uid() = friend_id);
CREATE POLICY "Users can send friend requests" ON friendships FOR INSERT 
    WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own friendships" ON friendships FOR UPDATE 
    USING (auth.uid() = user_id OR auth.uid() = friend_id);
CREATE POLICY "Users can delete own friendships" ON friendships FOR DELETE 
    USING (auth.uid() = user_id);

-- game_records: 游戏记录策略
CREATE POLICY "Users can view own games" ON game_records FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own games" ON game_records FOR INSERT WITH CHECK (auth.uid() = user_id);

-- beers: 啤酒库公开可读
CREATE POLICY "Beers are public readable" ON beers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Beers can be inserted by authenticated" ON beers FOR INSERT TO authenticated WITH CHECK (true);

-- 触发器: 创建新用户时自动创建 profile
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, username)
    VALUES (NEW.id, NEW.raw_user_meta_data->>'username');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
