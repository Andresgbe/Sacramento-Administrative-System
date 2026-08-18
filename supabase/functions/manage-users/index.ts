// Supabase Edge Function — admin-only user management (list / create / reset
// password / rename). Runs with the service role key, so it must verify the
// caller is an admin itself before doing anything privileged; never call
// auth.admin.* from the browser with the service role key.
// Deploy with: supabase functions deploy manage-users
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

interface RequestBody {
  action: 'list' | 'create' | 'update-password' | 'update-profile';
  email?: string;
  password?: string;
  nombreCompleto?: string;
  userId?: string;
  newPassword?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return jsonResponse({ error: 'No autorizado.' }, 401);
    }

    // Identify the caller using their own JWT (RLS-scoped client).
    const callerClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: userData, error: userError } = await callerClient.auth.getUser();
    if (userError || !userData.user) {
      return jsonResponse({ error: 'No autorizado.' }, 401);
    }

    const { data: callerRow } = await callerClient
      .from('usuarios')
      .select('rol')
      .eq('id', userData.user.id)
      .single();

    if (callerRow?.rol !== 'admin') {
      return jsonResponse({ error: 'Solo un administrador puede hacer esto.' }, 403);
    }

    // Privileged client — bypasses RLS, can call auth.admin.*.
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const body: RequestBody = await req.json();

    switch (body.action) {
      case 'list': {
        const [{ data: authList, error: authError }, { data: usuarios, error: usuariosError }] =
          await Promise.all([
            adminClient.auth.admin.listUsers(),
            adminClient.from('usuarios').select('*'),
          ]);

        if (authError) return jsonResponse({ error: authError.message });
        if (usuariosError) return jsonResponse({ error: usuariosError.message });

        const emailById = new Map(authList.users.map((u) => [u.id, u.email ?? '']));

        const result = (usuarios ?? []).map((row) => ({
          id: row.id,
          email: emailById.get(row.id) ?? '',
          nombreCompleto: row.nombre_completo,
          rol: row.rol,
          createdAt: row.created_at,
        }));

        return jsonResponse({ usuarios: result });
      }

      case 'create': {
        if (!body.email || !body.password || !body.nombreCompleto) {
          return jsonResponse({ error: 'Faltan datos del subadmin.' });
        }

        const { data: created, error: createError } = await adminClient.auth.admin.createUser({
          email: body.email,
          password: body.password,
          email_confirm: true,
        });

        if (createError || !created.user) {
          return jsonResponse({ error: createError?.message ?? 'No se pudo crear el usuario.' });
        }

        const { error: insertError } = await adminClient.from('usuarios').insert({
          id: created.user.id,
          nombre_completo: body.nombreCompleto,
          rol: 'subadmin',
        });

        if (insertError) {
          // Roll back the auth user so we don't leave an orphaned login with no profile.
          await adminClient.auth.admin.deleteUser(created.user.id);
          return jsonResponse({ error: insertError.message });
        }

        return jsonResponse({ error: null });
      }

      case 'update-password': {
        if (!body.userId || !body.newPassword) {
          return jsonResponse({ error: 'Faltan datos para cambiar la contraseña.' });
        }

        const { data: targetRow } = await adminClient
          .from('usuarios')
          .select('rol')
          .eq('id', body.userId)
          .single();

        if (targetRow?.rol !== 'subadmin') {
          return jsonResponse({ error: 'Solo se puede cambiar la contraseña de un subadmin.' });
        }

        const { error: updateError } = await adminClient.auth.admin.updateUserById(body.userId, {
          password: body.newPassword,
        });

        if (updateError) return jsonResponse({ error: updateError.message });
        return jsonResponse({ error: null });
      }

      case 'update-profile': {
        if (!body.userId || !body.nombreCompleto) {
          return jsonResponse({ error: 'Faltan datos para actualizar el usuario.' });
        }

        const { data: targetRow } = await adminClient
          .from('usuarios')
          .select('rol')
          .eq('id', body.userId)
          .single();

        if (targetRow?.rol !== 'subadmin') {
          return jsonResponse({ error: 'Solo se puede editar a un subadmin.' });
        }

        const { error: updateError } = await adminClient
          .from('usuarios')
          .update({ nombre_completo: body.nombreCompleto })
          .eq('id', body.userId);

        if (updateError) return jsonResponse({ error: updateError.message });
        return jsonResponse({ error: null });
      }

      default:
        return jsonResponse({ error: 'Acción no reconocida.' });
    }
  } catch (error) {
    return jsonResponse({ error: (error as Error).message }, 500);
  }
});
