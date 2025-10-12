import useSmartNavigation from '../../hooks/useSmartNavigation';

const BackToAccountButton = () => {
  const smartNavigate = useSmartNavigation();

  return (
    <button
      onClick={() => smartNavigate('/mi-cuenta')}
      className="text-sm text-emerald-700 hover:text-emerald-900 font-medium flex items-center gap-2 mb-6"
    >
      <span className="text-xl">←</span>
      Atrás
    </button>
  );
};

export default BackToAccountButton;
