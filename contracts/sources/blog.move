module sui_walrus_blog::blog {
    use sui::event;
    use sui::clock::{Self, Clock};
    public struct BlogPost has key {
        id: object::UID,
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
    }

    public struct Comment has store, copy, drop {
        author: vector<u8>,
        content: vector<u8>,
        created_at: u64,
    }

    const EInvalidTitle: u64 = 0;
    const EInvalidContent: u64 = 1;

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
            title: copy(title),
            content_hash,
            content_type,
            author: copy(author),
            created_at: clock::timestamp_ms(clock),
            updated_at: clock::timestamp_ms(clock),
            tags,
            likes: 0,
            comments: vector::empty<Comment>(),
            assets: vector::empty<Asset>(),
        };

        let post_id = object::id(&post);
        event::emit<PostCreated>(PostCreated { post_id, title, author });
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
        let asset = Asset {
            hash,
            asset_type: copy(asset_type),
            name: copy(name),
            created_at: clock::timestamp_ms(clock),
        };

        vector::push_back(&mut post.assets, asset);
        event::emit<AssetAdded>(AssetAdded {
            post_id: object::id(post),
            asset_name: name,
            asset_type,
        });
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

        post.title = copy(new_title);
        post.content_hash = new_content_hash;
        post.content_type = new_content_type;
        post.updated_at = clock::timestamp_ms(clock);

        event::emit<PostUpdated>(PostUpdated {
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
            author: copy(author),
            content,
            created_at: clock::timestamp_ms(clock),
        };

        vector::push_back(&mut post.comments, comment);
        event::emit<CommentAdded>(CommentAdded {
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
}
