json.extract! post, :id, :title, :descricao, :created_at, :updated_at
json.url post_url(post, format: :json)
