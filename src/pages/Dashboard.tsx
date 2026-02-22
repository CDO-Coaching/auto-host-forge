useEffect(() => {
  const checkUserApproval = async () => {
    // Attendre la session, avec tentative de refresh
    let { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      // Tenter un refresh avant de rediriger
      const { data } = await supabase.auth.refreshSession();
      session = data.session;
    }

    if (!session) {
      navigate("/auth");
      return;
    }

    setUserEmail(session.user.email || "");

    const { data: profile, error } = await supabase
      .from('user_profiles')
      .select('approved')
      .eq('id', session.user.id)
      .single();

    if (error) {
      console.error('Error fetching profile:', error);
      setIsApproved(false);
    } else {
      setIsApproved(profile?.approved || false);
    }

    setLoading(false);
  };

  checkUserApproval();

  const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
    // Ne rediriger que si c'est un logout explicite
    if (!session && event === 'SIGNED_OUT') {
      const isExplicit = localStorage.getItem('explicit_logout');
      if (isExplicit) {
        navigate("/auth");
      }
    } else if (session) {
      checkUserApproval();
    }
  });

  return () => subscription.unsubscribe();
}, [navigate]);

const handleLogout = async () => {
  localStorage.setItem('explicit_logout', 'true'); // localStorage pas sessionStorage !
  const { error } = await supabase.auth.signOut();
  if (error) {
    toast({ variant: "destructive", title: "Erreur lors de la déconnexion" });
  } else {
    toast({ title: "Déconnexion réussie" });
    navigate("/");
  }
};
