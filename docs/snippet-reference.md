# Snippet reference

`snippets/lookbook.liquid` is the reusable part of the lookbook. Both sections
are thin wrappers around it, and it can be rendered anywhere else too.

```liquid
{% render 'lookbook', uid: 'home-lookbook', heading: 'Shop the look' %}
```

## `lookbook` parameters

Every parameter is optional.

| Parameter | Default | What it does |
| --- | --- | --- |
| `uid` | `lookbook` | Unique id for this lookbook's JSON. **Required when two lookbooks share a page.** Pass `section.id` from a section. |
| `entry_source` | `all` | `all` for every Active entry, or `selected` to use `entries`. |
| `entries` | — | A metaobject list setting, used when `entry_source` is `selected`. |
| `entries_limit` | `6` | Looks in the first batch. With `all`, Show more loads the rest in batches of this size. On a product page, the maximum number of matches. |
| `products_limit` | `12` | Maximum products per look. |
| `heading` | — | Section heading (inline rich text). |
| `heading_size` | `h1` | `h0`, `h1` or `h2`. |
| `sub_heading` | — | Text under the heading. |
| `description` | — | Rich text under the sub heading. |
| `show_sub_heading` | `true` | Show each look's sub heading. |
| `show_description` | `true` | Show each look's description. |
| `masonry_row_height` | `120` | Row height in px for the Masonry templates. |
| `product_cta_label` | — | Button text over product images. **No default:** leave it empty for no button. |
| `show_notices` | `true` | Show help notices in the theme editor. |
| `containing_product` | — | A product. Only looks that include it are shown. Used by Related lookbook. |

## Output

- `<script type="application/json" id="LookbookData-{uid}">` with the settings
  and look ids. The fields are listed in
  [How it works](how-it-works.md#what-liquid-writes-into-the-page).
- `<div data-lookbook="LookbookData-{uid}">` holding the placeholder looks.
- In the theme editor, a notice when something needs fixing.

It outputs **nothing** when there is no Storefront API token or nothing to
show. Both sections capture the output and skip their wrapper when it's empty,
so an empty lookbook leaves no gap. Do the same when rendering it elsewhere:

```liquid
{%- capture lookbook_markup -%}
  {%- render 'lookbook', uid: 'my-lookbook' -%}
{%- endcapture -%}

{%- assign lookbook_markup = lookbook_markup | strip -%}
{%- if lookbook_markup != blank -%}
  {{ 'section-lookbook.css' | asset_url | stylesheet_tag }}
  <script src="{{ 'lookbook.js' | asset_url }}" defer="defer"></script>
  {{ lookbook_markup }}
{%- endif -%}
```

## `lookbook-skeleton` parameters

Rendered by `lookbook.liquid`; you don't normally render it yourself.

| Parameter | What it does |
| --- | --- |
| `looks` | Number of placeholder looks to draw. |
| `show_header` | Also draw a placeholder for the section heading. |
