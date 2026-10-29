<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Import processing queries use the shared generated client with a local schema type extension for migration-defined columns; never modify generated integration files to resolve stale Cloud types.
- Declare browser configuration keys in ImportMetaEnv so generated client access remains compatible with strict index-signature checks.
