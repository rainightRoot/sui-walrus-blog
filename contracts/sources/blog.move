module sui_walrus_blog::blog {
    use sui::event;
    use sui::object::{Self, UID};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};
    use sui::clock::{Self, Clock};
    use std::vector;

    #[allow(unused_const)]
    const EInvalidTitle: u64 = 0;
    #[allow(unused_const)]
    const EInvalidContent: u64 = 1;
    #[allow(unused_const)]
    const EAssetNotFound: u64 = 2;
    #[allow(unused_const)]
    const EAssetExpired: u64 = 3;
    #[allow(unused_const)]
    const ENotAuthorized: u64 = 4;

    const DEFAULT_ASSET_VALIDITY: u64 = 90 * 24 * 60 * 60 * 1000;

    public struct BlogPost has key {
        id: UID,
        title: vector<u8>,
        content_hash: vector<u8>,
        content_type: vector<u8>,
        author: vector<u8>,
        created_at: u64,
        updated_at: u64,
        tags: vector<vector<u8>>,
        likes: u64,
        comments: vector<Comment>,
        assets: vector<Asset>,
    }

    public struct Asset has store, copy, drop {
        hash: vector<u8>,
        asset_type: vector<u8>,
        name: vector<u8>,
        created_at: u64,
        expires_at: u64,
    }

    public struct Comment has store, copy, drop {
        author: vector<u8>,
        content: vector<u8>,
        created_at: u64,
    }

    public struct PostCreated has copy, drop {
        post_id: object::ID,
        title: vector<u8>,
        author: vector<u8>,
    }

    public struct PostUpdated has copy, drop {
        post_id: object::ID,
        title: vector<u8>,
    }

    public struct CommentAdded has copy, drop {
        post_id: object::ID,
        author: vector<u8>,
    }

    public struct AssetAdded has copy, drop {
        post_id: object::ID,
        asset_name: vector<u8>,
        asset_type: vector<u8>,
    }

    public struct AssetRenewed has copy, drop {
        post_id: object::ID,
        asset_name: vector<u8>,
        new_expires_at: u64,
    }

    // 自定义向量相等性比较函数
    fun bytes_equal(a: &vector<u8>, b: &vector<u8>): bool {
        let len_a = vector::length(a);
        let len_b = vector::length(b);
        
        if (len_a != len_b) {
            return false
        };
        
        let mut i = 0;
        while (i < len_a) {
            let byte_a = *vector::borrow(a, i);
            let byte_b = *vector::borrow(b, i);
            if (byte_a != byte_b) {
                return false
            };
            i = i + 1;
        };
        
        true
    }

    public entry fun create_post(
        title: vector<u8>,
        content_hash: vector<u8>,
        content_type: vector<u8>,
        author: vector<u8>,
        tags: vector<vector<u8>>,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        assert!(vector::length(&title) > 0, EInvalidTitle);
        assert!(vector::length(&content_hash) > 0, EInvalidContent);

        let post = BlogPost {
            id: object::new(ctx),
            title: copy title,
            content_hash,
            content_type,
            author: copy author,
            created_at: clock::timestamp_ms(clock),
            updated_at: clock::timestamp_ms(clock),
            tags,
            likes: 0,
            comments: vector::empty<Comment>(),
            assets: vector::empty<Asset>(),
        };

        let post_id = object::id(&post);
        event::emit(PostCreated { post_id, title, author });
        transfer::transfer(post, tx_context::sender(ctx));
    }

    public entry fun add_asset(
        post: &mut BlogPost,
        hash: vector<u8>,
        asset_type: vector<u8>,
        name: vector<u8>,
        clock: &Clock,
        _ctx: &mut TxContext
    ) {
        let now = clock::timestamp_ms(clock);
        let asset = Asset {
            hash,
            asset_type: copy asset_type,
            name: copy name,
            created_at: now,
            expires_at: now + DEFAULT_ASSET_VALIDITY,
        };

        vector::push_back(&mut post.assets, asset);
        event::emit(AssetAdded {
            post_id: object::id(post),
            asset_name: name,
            asset_type,
        });
    }

    public entry fun renew_asset(
        post: &mut BlogPost,
        asset_name: vector<u8>,
        author: vector<u8>,
        extension_days: u64,
        clock: &Clock,
        _ctx: &mut TxContext
    ) {
        assert!(bytes_equal(&post.author, &author), ENotAuthorized);
        
        let now = clock::timestamp_ms(clock);
        let (found, index) = find_asset_by_name(post, &asset_name);
        
        assert!(found, EAssetNotFound);
        
        // 获取post_id在修改之前
        let post_id = object::id(post);
        
        // 获取资产并更新过期时间
        let asset = vector::borrow_mut(&mut post.assets, index);
        let extension_ms = extension_days * 24 * 60 * 60 * 1000;
        
        if (asset.expires_at < now) {
            asset.expires_at = now + extension_ms;
        } else {
            asset.expires_at = asset.expires_at + extension_ms;
        };
        
        // 保存新的过期时间以在事件中使用
        let new_expires_at = asset.expires_at;
        
        // 使用前面保存的值发出事件，而不是再次访问post
        event::emit(AssetRenewed {
            post_id,
            asset_name,
            new_expires_at,
        });
    }

    fun find_asset_by_name(post: &BlogPost, name: &vector<u8>): (bool, u64) {
        let mut i = 0;
        let len = vector::length(&post.assets);
        
        while (i < len) {
            let asset = vector::borrow(&post.assets, i);
            if (bytes_equal(&asset.name, name)) {
                return (true, i)
            };
            i = i + 1;
        };
        
        (false, 0)
    }

    public fun is_asset_valid(asset: &Asset, clock: &Clock): bool {
        let now = clock::timestamp_ms(clock);
        asset.expires_at > now
    }

    public entry fun update_post(
        post: &mut BlogPost,
        new_title: vector<u8>,
        new_content_hash: vector<u8>,
        new_content_type: vector<u8>,
        clock: &Clock,
        _ctx: &mut TxContext
    ) {
        assert!(vector::length(&new_title) > 0, EInvalidTitle);
        assert!(vector::length(&new_content_hash) > 0, EInvalidContent);

        post.title = copy new_title;
        post.content_hash = new_content_hash;
        post.content_type = new_content_type;
        post.updated_at = clock::timestamp_ms(clock);

        event::emit(PostUpdated {
            post_id: object::id(post),
            title: new_title,
        });
    }

    public entry fun add_comment(
        post: &mut BlogPost,
        author: vector<u8>,
        content: vector<u8>,
        clock: &Clock,
        _ctx: &mut TxContext
    ) {
        let comment = Comment {
            author: copy author,
            content,
            created_at: clock::timestamp_ms(clock),
        };

        vector::push_back(&mut post.comments, comment);
        event::emit(CommentAdded {
            post_id: object::id(post),
            author,
        });
    }

    public entry fun like_post(post: &mut BlogPost) {
        post.likes = post.likes + 1;
    }

    public fun get_post(post: &BlogPost): (
        vector<u8>, vector<u8>, vector<u8>, vector<u8>,
        u64, u64, vector<vector<u8>>, u64
    ) {
        (
            post.title,
            post.content_hash,
            post.content_type,
            post.author,
            post.created_at,
            post.updated_at,
            post.tags,
            post.likes
        )
    }

    public fun get_asset_details(asset: &Asset): (
        vector<u8>, vector<u8>, vector<u8>, u64, u64
    ) {
        (
            asset.hash,
            asset.asset_type,
            asset.name,
            asset.created_at,
            asset.expires_at
        )
    }
}
